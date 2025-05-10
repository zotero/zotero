import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import { appendJwtToken } from '@/utils/AppendJwtToken';

import type { NewUser, User, WaitlistUser } from '../../types/usersType';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080/api';
// use this for testing
// const API_BASE_URL = 'http://localhost:8080/api';

export const usersApi = createApi({
  reducerPath: 'usersApi',
  baseQuery: fetchBaseQuery({
    prepareHeaders: (headers) => appendJwtToken(headers),
    baseUrl: `${API_BASE_URL}`,
    // mode: 'no-cors',
  }),
  endpoints: (builder) => ({
    getUserByProviderUserId: builder.query<User, string>({
      query: (providerUserId) => ({
        url: `/users/byProviderUserId/${providerUserId}`,
        method: 'GET',
      }),
    }),
    getUserById: builder.query<User, string>({
      query: (userId) => `/users/byUserId/${userId}`,
    }),
    deleteUserById: builder.mutation<string, string>({
      query: (userId) => ({
        url: `/users/byUserId/${userId}`,
        method: 'DELETE',
        body: userId,
      }),
    }),
    registerUser: builder.mutation<User, NewUser>({
      query: (user) => ({
        url: `/users/register`,
        method: 'POST',
        body: user,
      }),
    }),
    registerUserByInvitation: builder.mutation<
      User,
      { user: NewUser; invitationCode: string }
    >({
      query: ({ user, invitationCode }) => ({
        url: `/users/registerByInvitation`,
        method: 'POST',
        params: { invitationCode },
        body: user,
      }),
    }),
    getUserIdByProviderUserId: builder.query<string, string>({
      query: (providerUserId) =>
        `/users/userId/byProviderUserId/${providerUserId}`,
    }),
    updateUserNameByUserId: builder.mutation<
      User,
      { userId: string; userName: string }
    >({
      query: ({ userId, userName }) => ({
        url: `/users/updateName/${userId}/${userName}`,
        method: 'PUT',
      }),
    }),
    registerWaitlistUser: builder.mutation<WaitlistUser, WaitlistUser>({
      query: (waitListUser) => ({
        url: `/waitlistusers/addtowaitlist`,
        method: 'POST',
        body: waitListUser,
      }),
    }),
  }),
});

export const {
  useGetUserByProviderUserIdQuery,
  useLazyGetUserByProviderUserIdQuery,
  useGetUserByIdQuery,
  useDeleteUserByIdMutation,
  useRegisterUserMutation,
  useRegisterUserByInvitationMutation,
  useLazyGetUserIdByProviderUserIdQuery,
  useUpdateUserNameByUserIdMutation,
  useRegisterWaitlistUserMutation,
} = usersApi;
