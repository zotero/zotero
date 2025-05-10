import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';

import type { Session } from '@/libs/types/sessionType';

// Define the initial state for the Session slice
type SessionState = {
  sessions: Session[]; // An array to store sessions
  currentSession: Session | null;
  currentDocumentUrls: string[] | [];
  currentDocumentStoragePaths: string[] | [];
};

// Initial state
const initialState: SessionState = {
  sessions: [],
  currentSession: null,
  currentDocumentUrls: [],
  currentDocumentStoragePaths: [],
};

export const getSessionById = (sessions: Session[], id: string) => {
  return sessions.find((c) => c.id === id);
};

// Create a Redux slice
const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    setSessions: (state, action: PayloadAction<Session[]>) => {
      const sessions = Array.isArray(action.payload)
        ? action.payload
        : [action.payload];
      state.sessions = sessions;
    },
    setCurrentSession: (state, action: PayloadAction<Session>) => {
      state.currentSession = action.payload;
    },
    setCurrentDocumentUrls: (state, action: PayloadAction<string[]>) => {
      state.currentDocumentUrls = action.payload;
    },
    setCurrentDocumentStoragePaths: (
      state,
      action: PayloadAction<string[]>,
    ) => {
      state.currentDocumentStoragePaths = action.payload;
    },
    updateSession: (
      state,
      action: PayloadAction<Session | null | undefined>,
    ) => {
      if (action.payload == null) return;
      const sessionIdx = state.sessions.findIndex(
        (session) => session.id === action.payload?.id,
      );
      const sessionsClone = [...state.sessions];
      if (sessionIdx >= 0) {
        sessionsClone[sessionIdx] = action.payload;
        state.sessions = sessionsClone;
      }
    },
    deleteSessionById: (state, action: PayloadAction<string>) => {
      const sessionsClone = [...state.sessions];
      state.sessions = sessionsClone.filter(
        (session) => session.id !== action.payload,
      );
    },
  },
});

// Export actions and reducer
export const {
  setSessions,
  setCurrentSession,
  updateSession,
  deleteSessionById,
  setCurrentDocumentUrls,
  setCurrentDocumentStoragePaths,
} = sessionSlice.actions;
export default sessionSlice.reducer;
