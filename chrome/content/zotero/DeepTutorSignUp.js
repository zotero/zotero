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
  signUpButtonDisabled: {
    background: '#ccc',
    cursor: 'not-allowed',
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
  errorMessage: {
    color: '#dc3545',
    fontSize: '14px',
    marginTop: '8px',
    textAlign: 'center',
    width: '100%',
  },
  successMessage: {
    color: '#28a745',
    fontSize: '14px',
    marginTop: '8px',
    textAlign: 'center',
    width: '100%',
  },
  confirmationSection: {
    width: '100%',
    maxWidth: 400,
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
    alignItems: 'center',
    marginTop: 20,
  },
  confirmationText: {
    fontSize: '14px',
    color: '#4a4a4a',
    textAlign: 'center',
    marginBottom: 10,
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
      <div style={styles.titleSection}>
        <div style={styles.title}>Sign Up</div>
      </div>
      <div style={styles.subtitle}>Create a free account to start your unique learning experience</div>
      <form style={styles.form} autoComplete="off" onSubmit={handleSignUp}>
        <label style={styles.label}>Your Name</label>
        <input
          style={styles.input}
          type="text"
          placeholder=""
          value={name}
          onChange={e => setName(e.target.value)}
          disabled={isLoading}
        />
        <label style={styles.label}>Email Address</label>
        <input
          style={styles.input}
          type="email"
          placeholder="example@email.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          disabled={isLoading}
        />
        <label style={styles.label}>Create Password</label>
        <input
          style={styles.input}
          type="password"
          placeholder="At least 8 characters"
          value={password}
          onChange={e => setPassword(e.target.value)}
          disabled={isLoading}
        />
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
        
        <div style={styles.dividerRow}>
          <hr style={styles.divider} />
          <span style={styles.orText}>or</span>
          <hr style={styles.divider} />
        </div>
        <button 
          style={styles.googleButton} 
          type="button"
          onClick={handleGoogleSignUp}
          disabled={isLoading}
        >
          <img src={GoogleImg} alt="Google" style={styles.googleIcon} />
          Sign up with Google
        </button>
        <div style={styles.bottomRow}>
          Already have an account?
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