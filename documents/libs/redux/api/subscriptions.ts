import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import type {
  SubscriptionUsageEvent,
  UploadSessionBenefit,
  UserSubscription,
} from '@/libs/types/userSubscriptionType';
import { appendJwtToken } from '@/utils/AppendJwtToken';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080/api';

export const subscriptionsApi = createApi({
  reducerPath: 'subscriptionsApi',
  baseQuery: fetchBaseQuery({
    prepareHeaders: (headers) => appendJwtToken(headers),
    baseUrl: `${API_BASE_URL}`,
    // mode: 'no-cors',
  }),
  endpoints: (builder) => ({
    getSubscriptionBySubscriptionId: builder.query<UserSubscription, string>({
      query: (subscriptionId) => `subscriptions/${subscriptionId}`,
    }),
    getActiveSubscriptionForUserByUserId: builder.query<
      UserSubscription,
      string
    >({
      query: (userId) => `subscriptions/activeForUser/${userId}`,
    }),
    getLatestSubscriptionForUserByUserId: builder.query<
      UserSubscription,
      string
    >({
      query: (userId) => `subscriptions/latestForUser/${userId}`,
    }),
    getSubscriptionBenefitForUploadedSessionsByUserId: builder.query<
      UploadSessionBenefit,
      string
    >({
      query: (userId) => `subscriptions/uploadedSessionBenefit/${userId}`,
    }),
    getSubscriptionUsageHistoryForUserByUserId: builder.query<
      SubscriptionUsageEvent[],
      string
    >({
      query: (userId) => `subscriptions/usageHistory/${userId}`,
    }),
    getIsEligibleToCreateZeroShotSessionsByUserId: builder.query<
      Boolean,
      string
    >({
      query: (userId) => `subscriptions/zeroShotSessionEligibility/${userId}`,
    }),
    // updateEndTimeBySubscriptionId: builder.mutation<
    //   void,
    //   { subscriptionId: string; endTime: Date }
    // >({
    //   query: ({ subscriptionId, endTime }) => ({
    //     url: `subscriptions/updateEndTime/${subscriptionId}`,
    //     method: 'PUT',
    //     body: { endTime },
    //   }),
    // }),
    // createSubscription: builder.mutation<
    //   UserSubscription,
    //   SubscriptionRegistrationRequest
    // >({
    //   query: (requestBody) => ({
    //     url: 'subscriptions/create',
    //     method: 'POST',
    //     body: requestBody,
    //   }),
    // }),
  }),
});

export const {
  useLazyGetSubscriptionBySubscriptionIdQuery,
  useLazyGetActiveSubscriptionForUserByUserIdQuery,
  useLazyGetLatestSubscriptionForUserByUserIdQuery,
  useLazyGetSubscriptionBenefitForUploadedSessionsByUserIdQuery,
  useLazyGetSubscriptionUsageHistoryForUserByUserIdQuery,
  useLazyGetIsEligibleToCreateZeroShotSessionsByUserIdQuery,
} = subscriptionsApi;
