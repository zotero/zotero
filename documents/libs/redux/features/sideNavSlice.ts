import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';

export interface SideNavState {
  sideNavState: number;
}

const initialValue: SideNavState = {
  sideNavState: 1,
};
/* 
   We just use sideNaveState for every thing related to sideNav, 1 means open and 0 means closed
  */

const sideNavState = createSlice({
  name: 'sideNavState',
  initialState: initialValue,
  reducers: {
    setSideNavState: (state, action: PayloadAction<number>) => {
      state.sideNavState = action.payload;
    },
  },
});

export const { setSideNavState } = sideNavState.actions;
export default sideNavState.reducer;
