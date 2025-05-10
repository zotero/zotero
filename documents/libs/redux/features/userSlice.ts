import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';

import type { User } from '@/libs/types/usersType';

type UserState = {
  backendUser: User;
};

const defaultBackendUser = {
  id: '',
  name: '',
  email: '',
  passwordHash: '',
  profilePictureUrl: '',
  createdAt: '',
  updatedAt: '',
  providerId: '',
  provider: '',
  providerUserId: '',
};

const initialState: UserState = {
  backendUser: defaultBackendUser,
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setBackendUser: (state, action: PayloadAction<User>) => {
      state.backendUser = action.payload;
    },
    removeBackendUser: (state) => {
      state.backendUser = defaultBackendUser;
    },
  },
});

export const { setBackendUser, removeBackendUser } = userSlice.actions;
export default userSlice.reducer;
