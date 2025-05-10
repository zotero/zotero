import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import type { TokenBalance } from '@/libs/types/tokensType';
import { appendJwtToken } from '@/utils/AppendJwtToken';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080/api';

export const tokensApi = createApi({
  reducerPath: 'tokensApi',
  baseQuery: fetchBaseQuery({
    prepareHeaders: (headers) => appendJwtToken(headers),
    baseUrl: `${API_BASE_URL}`,
    // mode: 'no-cors',
  }),
  endpoints: (builder) => ({
    getBalanceByUserId: builder.query<TokenBalance, string>({
      query: (userId) => `tokenBalances/${userId}`,
    }),
    getTokenConsumptionHistoryByUserId: builder.query<TokenBalance[], string>({
      query: (userId) => `tokenBalances/${userId}/history`,
    }),
    addTokenBalanceByUserId: builder.mutation<
      TokenBalance,
      { userId: string; amountToAdd: number }
    >({
      query: ({ userId, amountToAdd }) => ({
        url: `tokenBalances/${userId}/add`,
        ethod: 'POST',
        body: { amountToAdd },
      }),
    }),
    lockTokenByUserId: builder.mutation<TokenBalance, string>({
      query: (userId) => ({
        url: `tokenBalances/${userId}/lock`,
        method: 'PUT',
      }),
    }),
    consumeLockedTokenByUserId: builder.mutation<TokenBalance, string>({
      query: (userId) => ({
        url: `tokenBalances/${userId}/consume`,
        method: 'PUT',
      }),
    }),
    recordFailureByUserId: builder.mutation<TokenBalance, string>({
      query: (userId) => ({
        url: `tokenBalances/${userId}/recordFailure`,
        method: 'PUT',
      }),
    }),
  }),
});

export const {
  useLazyGetBalanceByUserIdQuery,
  useLazyGetTokenConsumptionHistoryByUserIdQuery,
  useAddTokenBalanceByUserIdMutation,
  useLockTokenByUserIdMutation,
  useConsumeLockedTokenByUserIdMutation,
  useRecordFailureByUserIdMutation,
} = tokensApi;
