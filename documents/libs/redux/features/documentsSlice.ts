import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';

import type { TutorDocument } from '@/libs/types/DocumentType';

// Define the initial state for the document slice
type DocumentState = {
  documents: TutorDocument[]; // An array to store documents
};

// Initial state
const initialState: DocumentState = {
  documents: [],
};

export const getDocumentById = (documents: TutorDocument[], id: string) => {
  return documents.find((d) => d.id === id);
};

// Create a Redux slice
const documentSlice = createSlice({
  name: 'document',
  initialState,
  reducers: {
    setDocuments: (state, action: PayloadAction<TutorDocument[]>) => {
      const documents = Array.isArray(action.payload)
        ? action.payload
        : [action.payload];
      state.documents = documents;
    },
    updateDocument: (
      state,
      action: PayloadAction<TutorDocument | null | undefined>,
    ) => {
      if (action.payload == null) return;
      const documentIdx = state.documents.findIndex(
        (document) => document.id === action.payload?.id,
      );
      const documentsClone = [...state.documents];
      if (documentIdx >= 0) {
        documentsClone[documentIdx] = action.payload;
        state.documents = documentsClone;
      }
    },
    deleteDocumentById: (state, action: PayloadAction<string>) => {
      const documentsClone = [...state.documents];
      state.documents = documentsClone.filter(
        (document) => document.id !== action.payload,
      );
    },
  },
});

export const { setDocuments, updateDocument, deleteDocumentById } =
  documentSlice.actions;

export default documentSlice.reducer;
