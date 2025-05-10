import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';

type LandingState = {
  // two place to input prompt, prompt1 at the top of the landing page and promt2 at the bottom
  prompts: string[];
  promptInputIndex: number; // index 0 for prompt1 and 1 for prompt2
  subscribeButtonIndex: number;
  userEmail: string;
};

const initialState: LandingState = {
  prompts: ['', ''],
  promptInputIndex: -1,
  subscribeButtonIndex: -1,
  userEmail: '',
};

const landingSlice = createSlice({
  name: 'landing',
  initialState,
  reducers: {
    setPrompt1: (state, action: PayloadAction<string>) => {
      state.prompts[0] = action.payload;
    },
    setPrompt2: (state, action: PayloadAction<string>) => {
      state.prompts[1] = action.payload;
    },
    setPromptInputIndex: (state, action: PayloadAction<number>) => {
      state.promptInputIndex = action.payload;
    },
    setSubscribeButtonIndex: (state, action: PayloadAction<number>) => {
      state.subscribeButtonIndex = action.payload;
    },
    removePrompts: (state) => {
      state.prompts = ['', ''];
      state.promptInputIndex = -1;
    },
    setUserSignUpEmail: (state, action: PayloadAction<string>) => {
      state.userEmail = action.payload;
    },
    removeSignUpEmail: (state) => {
      state.userEmail = '';
    },
  },
});

export const {
  setPrompt1,
  setPrompt2,
  setPromptInputIndex,
  setSubscribeButtonIndex,
  removePrompts,
  setUserSignUpEmail,
  removeSignUpEmail,
} = landingSlice.actions;
export default landingSlice.reducer;
