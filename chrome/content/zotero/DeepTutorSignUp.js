import React, { useState } from 'react';
import { signUp, confirmSignUp, signInWithGoogle } from './auth/cognitoAuth.js';

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
    width: '90%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    margin: '0 auto',
  },
  mainContent: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: '1.875rem',
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
  },
  input: {
    width: '100%',
    minHeight: '2rem',
    borderRadius: '0.625rem',
    border: `1px solid #DADCE0`,
    padding: '0.375rem 0.5rem',
    background: PEARL,
    fontSize: '1rem',
    fontFamily: 'Roboto, sans-serif',
    outline: 'none',
  },
  signUpButton: {
    width: '100%',
    minHeight: '2.4375rem',
    borderRadius: '0.625rem',
    padding: '0.625rem 1.25rem',
    background: SKY,
    color: '#fff',
    fontWeight: 700,
    fontSize: '1.1rem',
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 0.0625rem 0.125rem rgba(0,0,0,0.08)',
    fontFamily: 'Roboto, sans-serif',
    letterSpacing: 0.2,
    marginTop: '1.25rem',
  },
  signUpButtonDisabled: {
    background: '#ccc',
    cursor: 'not-allowed',
  },
  dividerContainer: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    margin: '1.3125rem 0 0',
  },
  divider: {
    flex: 1,
    height: '0.0625rem',
    background: PEARL,
    border: 'none',
  },
  orText: {
    margin: '0 0.75rem',
    color: '#888',
    fontWeight: 500,
    fontSize: '1rem',
    marginBottom: '1.875rem',
  },
  googleContainer: {
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '1.875rem',
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
  },
  bottomText: {
    fontWeight: 500,
    fontSize: '0.875rem',
    color: '#888',
  },
  signInLink: {
    fontWeight: 500,
    fontSize: '0.875rem',
    textDecoration: 'underline',
    color: SKY,
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
    color: '#dc3545',
    fontSize: '0.875rem',
    marginTop: '0.625rem',
    textAlign: 'center',
    width: '100%',
  },
  subtitle: {
    fontWeight: 400,
    fontSize: '1.08rem',
    color: '#4a4a4a',
    marginBottom: '1.125rem',
    fontFamily: 'Roboto, sans-serif',
    width: '90%',
    textAlign: 'center',
  },
  confirmationSection: {
    width: '100%',
    maxWidth: '25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.125rem',
    alignItems: 'center',
    marginTop: '1.25rem',
  },
  confirmationText: {
    fontSize: '0.875rem',
    color: '#4a4a4a',
    textAlign: 'center',
    marginBottom: '0.625rem',
  },
};

const GoogleImg = 'chrome://zotero/content/DeepTutorMaterials/SignIn/Google.png';

export default function DeepTutorSignUp({ onSignUpSignIn }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmationCode, setConfirmationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [userSub, setUserSub] = useState('');

  const handleSignUp = async (e) => {
    e.preventDefault();
    
    if (!name || !email || !password) {
      setError('Please fill in all required fields');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      Zotero.debug('DeepTutor SignUp: Attempting to sign up with Cognito');
      const result = await signUp(email, password, name);
      
      Zotero.debug('DeepTutor SignUp: Sign up successful');
      setUserSub(result.userSub);
      
      if (!result.userConfirmed) {
        setNeedsConfirmation(true);
        setMessage('Registration successful! Please check your email and enter verification code.');
      } else {
        setMessage('Registration successful! You can now sign in.');
        setTimeout(() => {
          onSignUpSignIn();
        }, 2000);
      }
      
    } catch (error) {
      Zotero.debug(`DeepTutor SignUp: Sign up failed: ${error.message}`);
      
      // Handle specific Cognito errors
      let errorMessage = 'Registration failed, please try again';
      
      if (error.code === 'UsernameExistsException') {
        errorMessage = 'This email is already registered';
      } else if (error.code === 'InvalidPasswordException') {
        errorMessage = 'Password does not meet requirements';
      } else if (error.code === 'InvalidParameterException') {
        errorMessage = 'Invalid input parameters';
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

  const handleConfirmSignUp = async (e) => {
    e.preventDefault();
    
    if (!confirmationCode) {
      setError('Please enter verification code');
      return;
    }

    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      Zotero.debug('DeepTutor SignUp: Attempting to confirm sign up');
      await confirmSignUp(email, confirmationCode);
      
      Zotero.debug('DeepTutor SignUp: Email confirmation successful');
      setMessage('Email verification successful! You can now sign in.');
      
      setTimeout(() => {
        onSignUpSignIn();
      }, 2000);
      
    } catch (error) {
      Zotero.debug(`DeepTutor SignUp: Confirmation failed: ${error.message}`);
      
      let errorMessage = 'Verification failed, please try again';
      
      if (error.code === 'CodeMismatchException') {
        errorMessage = 'Incorrect verification code';
      } else if (error.code === 'ExpiredCodeException') {
        errorMessage = 'Verification code has expired';
      } else if (error.code === 'TooManyFailedAttemptsException') {
        errorMessage = 'Too many attempts, please try again later';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    try {
      setIsLoading(true);
      setError('');
      setMessage('');
      
      Zotero.debug('DeepTutor SignUp: Attempting Google sign up');
      await signInWithGoogle();
      setMessage('Redirecting to Google registration...');
      
    } catch (error) {
      Zotero.debug(`DeepTutor SignUp: Google sign up failed: ${error.message}`);
      setError('Google registration failed, please try again');
    } finally {
      setIsLoading(false);
    }
  };

  const resendConfirmationCode = async () => {
    try {
      setIsLoading(true);
      setError('');
      setMessage('');
      
      // Re-trigger sign up to resend confirmation code
      await signUp(email, password, name);
      setMessage('Verification code resent, please check your email');
      
    } catch (error) {
      Zotero.debug(`DeepTutor SignUp: Resend confirmation failed: ${error.message}`);
      setError('Failed to resend verification code, please try again');
    } finally {
      setIsLoading(false);
    }
  };

  if (needsConfirmation) {
    return (
      <div style={styles.container}>
        <div style={styles.titleSection}>
          <div style={styles.title}>Verify Email</div>
        </div>
        <div style={styles.confirmationText}>
          We have sent a verification code to {email}. Please enter the code to complete registration.
        </div>
        <form style={styles.confirmationSection} onSubmit={handleConfirmSignUp}>
          <label style={styles.label}>Verification Code</label>
          <input
            style={styles.input}
            type="text"
            placeholder="Enter 6-digit verification code"
            value={confirmationCode}
            onChange={e => setConfirmationCode(e.target.value)}
            disabled={isLoading}
            maxLength={6}
          />
          <button 
            style={{
              ...styles.signUpButton,
              ...(isLoading ? styles.signUpButtonDisabled : {})
            }}
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? 'Verifying...' : 'Verify Email'}
          </button>
          
          {error && <div style={styles.errorMessage}>{error}</div>}
          {message && <div style={styles.successMessage}>{message}</div>}
          
          <div style={styles.bottomRow}>
            Didn't receive verification code?
            <button 
              style={styles.signInLink} 
              type="button" 
              onClick={resendConfirmationCode}
              disabled={isLoading}
            >
              Resend
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.subtitle}>Create a free account to start your unique learning experience</div>
      <form style={styles.form} autoComplete="off" onSubmit={handleSignUp}>
        <div style={styles.mainContent}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Your Name</label>
            <input
              style={styles.input}
              type="text"
              placeholder=""
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={isLoading}
            />
          </div>
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
            <label style={styles.label}>Create Password</label>
            <input
              style={styles.input}
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <button 
            style={{
              ...styles.signUpButton,
              ...(isLoading ? styles.signUpButtonDisabled : {})
            }}
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? 'Signing up...' : 'Sign Up Free'}
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
            onClick={handleGoogleSignUp}
            disabled={isLoading}
          >
            <img src={GoogleImg} alt="Google" style={styles.googleIcon} />
            Sign up with Google
          </button>
        </div>

        <div style={styles.bottomContainer}>
          <span style={styles.bottomText}>Already have an account?</span>
          <button 
            style={styles.signInLink} 
            type="button" 
            onClick={onSignUpSignIn}
            disabled={isLoading}
          >
            Sign in
          </button>
        </div>
      </form>
    </div>
  );
} 