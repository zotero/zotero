import { createSlice } from '@reduxjs/toolkit';

const uiState = createSlice({
  name: 'uiState',
  initialState: 'initial', // Set an initial state
  reducers: {
    setUiState: (state, action) => {
      // eslint-disable-next-line no-param-reassign
      state = action.payload;
      return state;
    },
  },
});

export const { setUiState } = uiState.actions;
export default uiState.reducer;
