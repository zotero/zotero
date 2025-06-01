// Access ZOTERO_CONFIG from the global scope
const API_BASE_URL = 'https://api.staging.deeptutor.knowhiz.us/api';

// Import auth state to get access token
import { authState } from '../../auth/cognitoAuth.js';

// Helper function to get authorization headers
const getAuthHeaders = () => {
  const headers = {
    'Content-Type': 'application/json'
  };
  
  // Add Bearer token if user is authenticated
  const accessToken = authState.getAccessToken();
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  
  return headers;
};

// Helper function to handle API responses with token refresh
const handleApiResponse = async (response, originalRequest) => {
  if (response.status === 401) {
    // Token might be expired, try to refresh
    try {
      const { refreshSession } = await import('../../auth/cognitoAuth.js');
      await refreshSession();
      
      // Retry the original request with new token
      const newHeaders = getAuthHeaders();
      const retryResponse = await window.fetch(originalRequest.url, {
        ...originalRequest,
        headers: newHeaders
      });
      
      if (!retryResponse.ok) {
        throw new Error(`API request failed: ${retryResponse.status}`);
      }
      
      return retryResponse;
    } catch (refreshError) {
      Zotero.debug(`DeepTutor API: Token refresh failed: ${refreshError.message}`);
      // Clear auth state and redirect to login
      authState.setUnauthenticated();
      throw new Error('Authentication required');
    }
  }
  
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }
  
  return response;
};

// Message related API calls
export const getMessageByMessageId = async (messageId) => {
  const requestConfig = {
    method: 'GET',
    headers: getAuthHeaders()
  };
  
  const response = await window.fetch(`${API_BASE_URL}/message/${messageId}`, requestConfig);
  const handledResponse = await handleApiResponse(response, {
    url: `${API_BASE_URL}/message/${messageId}`,
    ...requestConfig
  });
  
  return handledResponse.json();
};

export const getMessagesBySessionId = async (sessionId) => {
  const requestConfig = {
    method: 'GET',
    headers: getAuthHeaders()
  };
  
  const response = await window.fetch(`${API_BASE_URL}/message/bySession/${sessionId}`, requestConfig);
  const handledResponse = await handleApiResponse(response, {
    url: `${API_BASE_URL}/message/bySession/${sessionId}`,
    ...requestConfig
  });
  
  return handledResponse.json();
};

export const createMessage = async (message) => {
  const requestConfig = {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(message)
  };
  
  const response = await window.fetch(`${API_BASE_URL}/message/create`, requestConfig);
  const handledResponse = await handleApiResponse(response, {
    url: `${API_BASE_URL}/message/create`,
    ...requestConfig
  });
  
  return handledResponse.json();
};

// Session related API calls
export const createSession = async (sessionData) => {
  const requestConfig = {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(sessionData)
  };
  
  const response = await window.fetch(`${API_BASE_URL}/session/create`, requestConfig);
  const handledResponse = await handleApiResponse(response, {
    url: `${API_BASE_URL}/session/create`,
    ...requestConfig
  });
  
  return handledResponse.json();
};

export const updateSessionName = async (sessionId, sessionName) => {
  const requestConfig = {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(sessionName)
  };
  
  const response = await window.fetch(`${API_BASE_URL}/session/${sessionId}/name`, requestConfig);
  const handledResponse = await handleApiResponse(response, {
    url: `${API_BASE_URL}/session/${sessionId}/name`,
    ...requestConfig
  });
  
  return handledResponse.json();
};

export const getSessionById = async (sessionId) => {
  const requestConfig = {
    method: 'GET',
    headers: getAuthHeaders()
  };
  
  const response = await window.fetch(`${API_BASE_URL}/session/${sessionId}`, requestConfig);
  const handledResponse = await handleApiResponse(response, {
    url: `${API_BASE_URL}/session/${sessionId}`,
    ...requestConfig
  });
  
  return handledResponse.json();
};

export const getSessionsByUserId = async (userId) => {
  const requestConfig = {
    method: 'GET',
    headers: getAuthHeaders()
  };
  
  const response = await window.fetch(`${API_BASE_URL}/session/byUser/${userId}`, requestConfig);
  const handledResponse = await handleApiResponse(response, {
    url: `${API_BASE_URL}/session/byUser/${userId}`,
    ...requestConfig
  });
  
  return handledResponse.json();
};

// User related API calls
export const getUserById = async (userId) => {
  const requestConfig = {
    method: 'GET',
    headers: getAuthHeaders()
  };
  
  const response = await window.fetch(`${API_BASE_URL}/users/byUserId/${userId}`, requestConfig);
  const handledResponse = await handleApiResponse(response, {
    url: `${API_BASE_URL}/users/byUserId/${userId}`,
    ...requestConfig
  });
  
  return handledResponse.json();
};

// Document related API calls
export const getDocumentById = async (documentId) => {
  const requestConfig = {
    method: 'GET',
    headers: getAuthHeaders()
  };
  
  const response = await window.fetch(`${API_BASE_URL}/document/${documentId}`, requestConfig);
  const handledResponse = await handleApiResponse(response, {
    url: `${API_BASE_URL}/document/${documentId}`,
    ...requestConfig
  });
  
  return handledResponse.json();
};

export const getPreSignedUrl = async (userId, fileName) => {
  const requestConfig = {
    method: 'GET',
    headers: getAuthHeaders()
  };
  
  const response = await window.fetch(`${API_BASE_URL}/document/preSignedUrl/${userId}/${fileName}`, requestConfig);
  const handledResponse = await handleApiResponse(response, {
    url: `${API_BASE_URL}/document/preSignedUrl/${userId}/${fileName}`,
    ...requestConfig
  });
  
  return handledResponse.json();
};

// Chat stream related API calls
export const subscribeToChat = async (conversation) => {
  const requestConfig = {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Accept': 'text/event-stream'
    },
    body: JSON.stringify(conversation)
  };
  
  const response = await window.fetch(`${API_BASE_URL}/chat/subscribe`, requestConfig);
  const handledResponse = await handleApiResponse(response, {
    url: `${API_BASE_URL}/chat/subscribe`,
    ...requestConfig
  });
  
  return handledResponse;
};
