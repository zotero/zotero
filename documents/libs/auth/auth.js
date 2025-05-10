import { fetchAuthSession } from 'aws-amplify/auth';

// Get the JWT token from Amplify
export const getAuthToken = async () => {
  try {
    const session = await fetchAuthSession({ forceRefresh: true });
    if (session && session.tokens?.idToken) {
      return session.tokens.idToken.toString();
    }
    return null;
  } catch (err) {
    console.error('Error getting auth token:', err);
    return null;
  }
};

// Add JWT token to headers
export const getAuthHeaders = async () => {
  const headers = new Headers();
  const token = await getAuthToken();
  if (token) {
    headers.append('Authorization', `Bearer ${token}`);
  }
  headers.append('Content-Type', 'application/json');
  return headers;
};

// Check if user is logged in
export const checkLogin = async () => {
  try {
    await fetchAuthSession();
    return true;
  } catch (err) {
    console.error('Error checking login:', err);
    return false;
  }
}; 