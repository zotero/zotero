const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080/api';
import { getAuthHeaders } from '../auth/auth';

// Get message by message ID
export const getMessageByMessageId = async (messageId) => {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/message/${messageId}`, {
    headers
  });
  if (!response.ok) {
    throw new Error('Failed to fetch message');
  }
  return response.json();
};

// Get messages by session ID
export const getMessagesBySessionId = async (sessionId) => {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/message/bySession/${sessionId}`, {
    headers
  });
  if (!response.ok) {
    throw new Error('Failed to fetch messages');
  }
  return response.json();
};

// Create a new message
export const createMessage = async (message) => {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/message/create`, {
    method: 'POST',
    headers,
    body: JSON.stringify(message)
  });
  if (!response.ok) {
    throw new Error('Failed to create message');
  }
  return response.json();
};

// Update session name
export const updateSessionName = async (sessionId, sessionName) => {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/session/${sessionId}/name`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(sessionName)
  });
  if (!response.ok) {
    throw new Error('Failed to update session name');
  }
  return response.json();
}; 