import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';

// Define the initial state for the document slice
type UploadState = {
  files: File[]; // An array to store documents
};

// Initial state
const initialState: UploadState = {
  files: [],
};

// Create a Redux slice
const uploadSlice = createSlice({
  name: 'upload',
  initialState,
  reducers: {
    setUploadFiles: (state, action: PayloadAction<File[]>) => {
      const files = Array.isArray(action.payload)
        ? action.payload
        : [action.payload];
      state.files = files;
    },
    deleteUploadFiles: (state) => {
      state.files = [];
    },
  },
});

export const { setUploadFiles, deleteUploadFiles } = uploadSlice.actions;

export default uploadSlice.reducer;
