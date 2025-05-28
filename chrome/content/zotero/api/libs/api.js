// Access ZOTERO_CONFIG from the global scope
const API_BASE_URL = 'https://api.staging.deeptutor.knowhiz.us/api';

// Message related API calls
export const getMessageByMessageId = async (messageId) => {
  const response = await window.fetch(`${API_BASE_URL}/message/${messageId}`, {
    headers: {
      'Content-Type': 'application/json'
    }
  });
  if (!response.ok) {
    throw new Error('Failed to fetch message');
  }
  return response.json();
};

export const getMessagesBySessionId = async (sessionId) => {
  const response = await window.fetch(`${API_BASE_URL}/message/bySession/${sessionId}`, {
    headers: {
      'Content-Type': 'application/json'
    }
  });
  if (!response.ok) {
    throw new Error('Failed to fetch messages');
  }
  return response.json();
};

export const createMessage = async (message) => {
  const response = await window.fetch(`${API_BASE_URL}/message/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(message)
  });
  if (!response.ok) {
    throw new Error('Failed to create message');
  }
  return response.json();
};

// Session related API calls
export const createSession = async (sessionData) => {
  const response = await window.fetch(`${API_BASE_URL}/session/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(sessionData)
  });
  if (!response.ok) {
    throw new Error('Failed to create session');
  }
  return response.json();
};

export const updateSessionName = async (sessionId, sessionName) => {
  const response = await window.fetch(`${API_BASE_URL}/session/${sessionId}/name`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(sessionName)
  });
  if (!response.ok) {
    throw new Error('Failed to update session name');
  }
  return response.json();
};

export const getSessionById = async (sessionId) => {
  const response = await window.fetch(`${API_BASE_URL}/session/${sessionId}`, {
    headers: {
      'Content-Type': 'application/json'
    }
  });
  if (!response.ok) {
    throw new Error('Failed to fetch session');
  }
  return response.json();
};

export const getSessionsByUserId = async (userId) => {
  const response = await window.fetch(`${API_BASE_URL}/session/byUser/${userId}`, {
    headers: {
      'Content-Type': 'application/json'
    }
  });
  if (!response.ok) {
    throw new Error('Failed to fetch sessions');
  }
  return response.json();
};

// User related API calls
export const getUserById = async (userId) => {
  const response = await window.fetch(`${API_BASE_URL}/users/byUserId/${userId}`, {
    headers: {
      'Content-Type': 'application/json'
    }
  });
  if (!response.ok) {
    throw new Error('Failed to fetch user');
  }
  return response.json();
};

// Document related API calls
export const getDocumentById = async (documentId) => {
  const response = await window.fetch(`${API_BASE_URL}/document/${documentId}`, {
    headers: {
      'Content-Type': 'application/json'
    }
  });
  if (!response.ok) {
    throw new Error('Failed to fetch document');
  }
  return response.json();
};

export const getPreSignedUrl = async (userId, fileName) => {
  const response = await window.fetch(`${API_BASE_URL}/document/preSignedUrl/${userId}/${fileName}`, {
    headers: {
      'Content-Type': 'application/json'
    }
  });
  if (!response.ok) {
    throw new Error('Failed to get pre-signed URL');
  }
  return response.json();
};

// Chat stream related API calls
export const subscribeToChat = async (conversation) => {
  const response = await window.fetch(`${API_BASE_URL}/chat/subscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream'
    },
    body: JSON.stringify(conversation)
  });
  if (!response.ok) {
    throw new Error('Failed to subscribe to chat');
  }
  return response;
};
