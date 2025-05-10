import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/dist/query';

import { chatApi } from '@/libs/redux/api/chat';
import { documentsApi } from '@/libs/redux/api/documents';
import { messageApi } from '@/libs/redux/api/message';
import { sessionsApi } from '@/libs/redux/api/sessions';
import { subscriptionsApi } from '@/libs/redux/api/subscriptions';
import { tokensApi } from '@/libs/redux/api/tokens';
import { usersApi } from '@/libs/redux/api/users';

import documentReducer from './features/documentsSlice';
import landingReducer from './features/landingSlice';
import sessionReducer from './features/sessionSlice';
import sideNavReducer from './features/sideNavSlice';
import subscriptionReducer from './features/subscriptionSlice';
import uiReducer from './features/uiSlice';
import uploadReducer from './features/uploadSlice';
import userReducer from './features/userSlice';

export const store = configureStore({
  reducer: {
    user: userReducer,
    uiState: uiReducer,
    sideNavState: sideNavReducer,
    subscription: subscriptionReducer,
    upload: uploadReducer,
    landing: landingReducer,
    session: sessionReducer,
    document: documentReducer,
    [usersApi.reducerPath]: usersApi.reducer,
    [tokensApi.reducerPath]: tokensApi.reducer,
    [subscriptionsApi.reducerPath]: subscriptionsApi.reducer,
    [sessionsApi.reducerPath]: sessionsApi.reducer,
    [documentsApi.reducerPath]: documentsApi.reducer,
    [chatApi.reducerPath]: chatApi.reducer,
    [messageApi.reducerPath]: messageApi.reducer,
  },
  // @ts-ignore
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false }).concat(
      usersApi.middleware,
      tokensApi.middleware,
      subscriptionsApi.middleware,
      sessionsApi.middleware,
      documentsApi.middleware,
      chatApi.middleware,
      messageApi.middleware,
    ),
});

setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
